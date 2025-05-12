import pymongo
import dns.resolver
import socket
import time
import sys
import os

# The MongoDB connection string
MONGO_URI = "mongodb+srv://hennryx101:OIXs7TPJhxHX9o8F@cluster0.croadpx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
DB_NAME = "Cluster0"

def test_dns_resolution():
    """Test DNS resolution for the MongoDB host."""
    print("\n=== Testing DNS Resolution ===")
    try:
        # Extract the hostname from the connection string
        if "mongodb+srv://" in MONGO_URI:
            hostname = MONGO_URI.split("@")[1].split("/")[0]
            print(f"Testing SRV record for: {hostname}")
            
            # Look up SRV records
            try:
                answers = dns.resolver.resolve(f"_mongodb._tcp.{hostname}", "SRV")
                print(f"SRV records found: {len(answers)}")
                for rdata in answers:
                    print(f"  Priority: {rdata.priority}, Weight: {rdata.weight}, Target: {rdata.target}, Port: {rdata.port}")
                    
                    # Try to resolve the actual hostname
                    try:
                        ip_answers = dns.resolver.resolve(str(rdata.target), "A")
                        print(f"  IP addresses for {rdata.target}:")
                        for ip in ip_answers:
                            print(f"    {ip}")
                    except Exception as e:
                        print(f"  Error resolving {rdata.target}: {str(e)}")
                return True
            except Exception as e:
                print(f"Error resolving SRV records: {str(e)}")
                
                # Try direct hostname resolution as fallback
                try:
                    print(f"Trying direct hostname resolution for: {hostname}")
                    ip_answers = dns.resolver.resolve(hostname, "A")
                    print(f"IP addresses found: {len(ip_answers)}")
                    for ip in ip_answers:
                        print(f"  {ip}")
                    return True
                except Exception as e2:
                    print(f"Error with direct hostname resolution: {str(e2)}")
                    return False
        else:
            # Standard MongoDB URI
            hostname = MONGO_URI.split("@")[1].split(":")[0].split("/")[0]
            print(f"Testing hostname resolution for: {hostname}")
            
            try:
                ip_addresses = socket.gethostbyname_ex(hostname)
                print(f"Hostname resolved to: {ip_addresses}")
                return True
            except Exception as e:
                print(f"Error resolving hostname: {str(e)}")
                return False
    except Exception as e:
        print(f"DNS resolution test failed: {str(e)}")
        return False

def test_socket_connection():
    """Test raw socket connection to MongoDB servers."""
    print("\n=== Testing Socket Connection ===")
    try:
        # Extract the hostname from the connection string
        if "mongodb+srv://" in MONGO_URI:
            hostname = MONGO_URI.split("@")[1].split("/")[0]
            print(f"Testing connection to MongoDB Atlas cluster: {hostname}")
            
            # For SRV connections, we need to look up the actual hosts
            try:
                answers = dns.resolver.resolve(f"_mongodb._tcp.{hostname}", "SRV")
                all_success = True
                
                for rdata in answers:
                    target = str(rdata.target)
                    port = rdata.port
                    
                    print(f"Testing socket connection to {target}:{port}...")
                    try:
                        start_time = time.time()
                        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                        s.settimeout(5)
                        s.connect((target, port))
                        s.close()
                        elapsed = time.time() - start_time
                        print(f"  Connected successfully in {elapsed:.2f} seconds")
                    except Exception as e:
                        print(f"  Failed to connect to {target}:{port}: {str(e)}")
                        all_success = False
                
                return all_success
            except Exception as e:
                print(f"Error resolving SRV records: {str(e)}")
                return False
        else:
            # Standard MongoDB URI format
            parts = MONGO_URI.split("@")[1].split("/")[0]
            if ":" in parts:
                hostname, port_str = parts.split(":")
                port = int(port_str)
            else:
                hostname = parts
                port = 27017  # Default MongoDB port
                
            print(f"Testing socket connection to {hostname}:{port}...")
            try:
                start_time = time.time()
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(5)
                s.connect((hostname, port))
                s.close()
                elapsed = time.time() - start_time
                print(f"Connected successfully in {elapsed:.2f} seconds")
                return True
            except Exception as e:
                print(f"Failed to connect: {str(e)}")
                return False
    except Exception as e:
        print(f"Socket connection test failed: {str(e)}")
        return False

def test_mongodb_connection():
    """Test full MongoDB connection."""
    print("\n=== Testing MongoDB Connection ===")
    try:
        print(f"Connecting to MongoDB: {MONGO_URI}")
        
        # Set timeouts explicitly
        start_time = time.time()
        client = pymongo.MongoClient(
            MONGO_URI,
            connectTimeoutMS=5000,  # 5 seconds
            socketTimeoutMS=5000,   # 5 seconds
            serverSelectionTimeoutMS=5000  # 5 seconds
        )
        
        # Test the connection
        print("Sending ping command...")
        client.admin.command('ping')
        
        elapsed = time.time() - start_time
        print(f"MongoDB connection successful in {elapsed:.2f} seconds!")
        
        # Test database access
        db = client[DB_NAME]
        print(f"Accessing database: {DB_NAME}")
        
        # List collections
        collections = db.list_collection_names()
        print(f"Collections in database: {collections}")
        
        # Test a specific collection if exists
        if "fingerprints" in collections:
            print("Testing fingerprints collection...")
            count = db.fingerprints.count_documents({})
            print(f"Found {count} fingerprint records")
        
        client.close()
        return True
    except pymongo.errors.ConnectionFailure as e:
        print(f"MongoDB connection failed: {str(e)}")
        return False
    except pymongo.errors.ServerSelectionTimeoutError as e:
        print(f"MongoDB server selection timed out: {str(e)}")
        return False
    except pymongo.errors.OperationFailure as e:
        print(f"MongoDB operation failure: {str(e)}")
        return False
    except Exception as e:
        print(f"MongoDB connection test failed with unknown error: {str(e)}")
        return False

def network_info():
    """Display general network information."""
    print("\n=== Network Information ===")
    try:
        # Get hostname
        hostname = socket.gethostname()
        print(f"Local hostname: {hostname}")
        
        # Get IP address
        try:
            ip_address = socket.gethostbyname(hostname)
            print(f"Local IP address: {ip_address}")
        except Exception as e:
            print(f"Failed to get local IP: {str(e)}")
        
        # Check internet connectivity with common sites
        sites = ["google.com", "mongodb.com", "github.com"]
        for site in sites:
            try:
                print(f"Testing connection to {site}...")
                start_time = time.time()
                socket.create_connection((site, 80), timeout=5)
                elapsed = time.time() - start_time
                print(f"  Connected to {site} in {elapsed:.2f} seconds")
            except Exception as e:
                print(f"  Failed to connect to {site}: {str(e)}")
    except Exception as e:
        print(f"Failed to gather network information: {str(e)}")

def test_connectivity_timing():
    """Test connection timing to Atlas servers."""
    print("\n=== Connection Timing Test ===")
    try:
        # Extract the hostname from the connection string
        if "mongodb+srv://" in MONGO_URI:
            hostname = MONGO_URI.split("@")[1].split("/")[0]
            
            try:
                answers = dns.resolver.resolve(f"_mongodb._tcp.{hostname}", "SRV")
                
                for rdata in answers:
                    target = str(rdata.target)
                    port = rdata.port
                    
                    results = []
                    print(f"\nTesting connection timing to {target}:{port}...")
                    
                    # Multiple connection tests for timing assessment
                    for i in range(3):
                        try:
                            start_time = time.time()
                            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                            s.settimeout(10)
                            s.connect((target, port))
                            s.close()
                            elapsed = time.time() - start_time
                            results.append(elapsed)
                            print(f"  Test {i+1}: Connected in {elapsed:.2f} seconds")
                        except Exception as e:
                            print(f"  Test {i+1}: Failed - {str(e)}")
                    
                    if results:
                        avg_time = sum(results) / len(results)
                        print(f"  Average connection time: {avg_time:.2f} seconds")
                        if avg_time > 1.0:
                            print("  ⚠️ Connection time is high, might cause timeouts")
                        else:
                            print("  ✓ Connection time is acceptable")
            except Exception as e:
                print(f"Failed to resolve SRV records: {str(e)}")
    except Exception as e:
        print(f"Connection timing test failed: {str(e)}")

def run_all_tests():
    """Run all connection tests."""
    print("\n===== MONGODB CONNECTION DIAGNOSTIC TESTS =====")
    print(f"Testing connection to: {MONGO_URI}")
    
    # Run network info first
    network_info()
    
    # Then DNS resolution
    dns_success = test_dns_resolution()
    
    # Then socket connection if DNS worked
    socket_success = False
    if dns_success:
        socket_success = test_socket_connection()
    
    # Test connection timing
    if socket_success:
        test_connectivity_timing()
    
    # Then full MongoDB connection
    mongodb_success = test_mongodb_connection()
    
    # Summary
    print("\n===== TEST SUMMARY =====")
    print(f"DNS Resolution: {'✓ SUCCESS' if dns_success else '❌ FAILED'}")
    print(f"Socket Connection: {'✓ SUCCESS' if socket_success else '❌ FAILED'}")
    print(f"MongoDB Connection: {'✓ SUCCESS' if mongodb_success else '❌ FAILED'}")
    
    if not mongodb_success:
        print("\n===== TROUBLESHOOTING SUGGESTIONS =====")
        if not dns_success:
            print("- DNS resolution failed. Check your internet connection.")
            print("- Verify that the MongoDB hostname is correct.")
        elif not socket_success:
            print("- Socket connection failed. This suggests a network connectivity issue.")
            print("- Check if you're behind a firewall that blocks MongoDB connections.")
            print("- Verify that MongoDB Atlas IP whitelist includes your IP address.")
        else:
            print("- DNS and socket connections succeeded, but MongoDB connection failed.")
            print("- Check if your database credentials are correct.")
            print("- Verify that the MongoDB user has appropriate permissions.")
            print("- Consider increasing connection timeouts in your application.")
    
    return mongodb_success

if __name__ == "__main__":
    if len(sys.argv) > 1:
        MONGO_URI = sys.argv[1]
    if len(sys.argv) > 2:
        DB_NAME = sys.argv[2]
    
    success = run_all_tests()
    sys.exit(0 if success else 1)