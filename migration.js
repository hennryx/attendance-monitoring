// migration.js - Script to migrate existing fingerprints to the new schema
const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Connection URI
const uri =
  process.env.MONGO_URI ||
  "mongodb+srv://hennryx101:OIXs7TPJhxHX9o8F@cluster0.croadpx.mongodb.net/Cluster0";

// Connect to MongoDB
mongoose
  .connect(uri)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => {
    console.error("Connection error", err);
    process.exit(1);
  });

// Get a reference to the FingerPrint collection directly
// This lets us work with the raw collection without schema validation
const db = mongoose.connection;

async function migrateData() {
  try {
    // Wait for connection
    await new Promise((resolve) => {
      if (db.readyState === 1) {
        resolve();
      } else {
        db.once("open", resolve);
      }
    });

    const fingerPrintCollection = db.collection("fingerprints");

    // Get all existing fingerprints
    const existingFingerprints = await fingerPrintCollection.find({}).toArray();
    console.log(`Found ${existingFingerprints.length} fingerprints to migrate`);

    // For each fingerprint, update to the new schema
    let migratedCount = 0;

    for (const fingerprint of existingFingerprints) {
      // Only migrate if it doesn't already have an enrollmentIndex
      if (fingerprint.enrollmentIndex === undefined) {
        // Add new fields
        const update = {
          $set: {
            enrollmentIndex: 0, // First enrollment
            // Extract metadata from template if available
            enrollmentMeta: {
              quality: 1.0, // Default quality
              minutiaeCount: fingerprint.template?.minutiae?.length || 0,
              keypointCount: fingerprint.template?.keypoints?.length || 0,
            },
          },
        };

        // If fingerPrint field is required in your new schema, keep it
        // If it's optional, you could remove it to save space
        // Uncomment this if you want to make fingerPrint optional
        /*
        if (process.env.REMOVE_ORIGINAL_IMAGES === 'true') {
          update.$unset = { fingerPrint: "" };
        }
        */

        // Update the document
        const result = await fingerPrintCollection.updateOne(
          { _id: fingerprint._id },
          update
        );

        if (result.modifiedCount > 0) {
          migratedCount++;
        }
      }
    }

    console.log(`Successfully migrated ${migratedCount} fingerprints`);

    // Create the compound index if it doesn't exist
    await fingerPrintCollection.createIndex({ staffId: 1, enrollmentIndex: 1 });
    console.log("Index created successfully");

    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Migration error:", error);
  } finally {
    // Close the connection
    mongoose.connection.close();
  }
}

// Run the migration
migrateData().catch(console.error);
