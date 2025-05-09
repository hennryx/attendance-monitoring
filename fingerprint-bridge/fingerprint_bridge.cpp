#include <napi.h>
#include <windows.h>
#include <string>
#include <vector>
#include <iostream>
#include <memory>

// Include the DigitalPersona SDK headers
#include "dpfj.h"
#include "dpfj_compression.h"
#include "dpfj_quality.h"
#include "dpfpdd.h"

class FingerprintBridge : public Napi::ObjectWrap<FingerprintBridge> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    FingerprintBridge(const Napi::CallbackInfo& info);

private:
    static Napi::FunctionReference constructor;

    // Device management methods
    Napi::Value GetDeviceList(const Napi::CallbackInfo& info);
    Napi::Value OpenDevice(const Napi::CallbackInfo& info);
    Napi::Value CloseDevice(const Napi::CallbackInfo& info);

    // Fingerprint capture methods
    Napi::Value CaptureFingerprint(const Napi::CallbackInfo& info);
    
    // Feature extraction and matching methods
    Napi::Value ExtractFeatures(const Napi::CallbackInfo& info);
    Napi::Value CompareFeatures(const Napi::CallbackInfo& info);
    
    // Utility methods
    std::string base64Encode(const std::vector<unsigned char>& data);
    std::vector<unsigned char> base64Decode(const std::string& encoded);

    // Member variables
    DPFPDD_DEV device_handle_;
    bool device_open_;
};

Napi::FunctionReference FingerprintBridge::constructor;

Napi::Object FingerprintBridge::Init(Napi::Env env, Napi::Object exports) {
    Napi::HandleScope scope(env);

    Napi::Function func = DefineClass(env, "FingerprintBridge", {
        InstanceMethod("getDeviceList", &FingerprintBridge::GetDeviceList),
        InstanceMethod("openDevice", &FingerprintBridge::OpenDevice),
        InstanceMethod("closeDevice", &FingerprintBridge::CloseDevice),
        InstanceMethod("captureFingerprint", &FingerprintBridge::CaptureFingerprint),
        InstanceMethod("extractFeatures", &FingerprintBridge::ExtractFeatures),
        InstanceMethod("compareFeatures", &FingerprintBridge::CompareFeatures),
    });

    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();

    exports.Set("FingerprintBridge", func);
    return exports;
}

FingerprintBridge::FingerprintBridge(const Napi::CallbackInfo& info) 
    : Napi::ObjectWrap<FingerprintBridge>(info), device_open_(false) {
    Napi::Env env = info.Env();
    Napi::HandleScope scope(env);

    // Initialize the DigitalPersona SDK
    DPFPDD_INIT_PARAM init_param = {0};
    init_param.size = sizeof(DPFPDD_INIT_PARAM);
    DPFPDD_RESULT result = dpfpdd_init(&init_param);
    
    if (result != DPFPDD_SUCCESS) {
        Napi::Error::New(env, "Failed to initialize DigitalPersona SDK").ThrowAsJavaScriptException();
        return;
    }
}

Napi::Value FingerprintBridge::GetDeviceList(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    // Get the number of devices
    int device_count = 0;
    DPFPDD_RESULT result = dpfpdd_get_device_count(&device_count);
    
    if (result != DPFPDD_SUCCESS) {
        return Napi::Number::New(env, 0);
    }
    
    // If no devices, return empty array
    if (device_count == 0) {
        return Napi::Array::New(env, 0);
    }
    
    // Get device information
    std::vector<DPFPDD_DEV_INFO> devices(device_count);
    devices[0].size = sizeof(DPFPDD_DEV_INFO);
    
    result = dpfpdd_query_devices(&device_count, &devices[0]);
    
    if (result != DPFPDD_SUCCESS) {
        return Napi::Array::New(env, 0);
    }
    
    // Create return array
    Napi::Array device_array = Napi::Array::New(env, device_count);
    
    for (int i = 0; i < device_count; i++) {
        Napi::Object device_obj = Napi::Object::New(env);
        device_obj.Set("name", Napi::String::New(env, devices[i].name));
        device_obj.Set("id", Napi::String::New(env, devices[i].id));
        device_array[i] = device_obj;
    }
    
    return device_array;
}

Napi::Value FingerprintBridge::OpenDevice(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    // Check parameters
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Device ID expected").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string device_id = info[0].As<Napi::String>().Utf8Value();
    
    // First, close any previously opened device
    if (device_open_) {
        dpfpdd_close(device_handle_);
        device_open_ = false;
    }
    
    // Open the device
    DPFPDD_RESULT result = dpfpdd_open(device_id.c_str(), &device_handle_);
    
    if (result != DPFPDD_SUCCESS) {
        std::string error_msg = "Failed to open device: " + std::to_string(result);
        Napi::Error::New(env, error_msg).ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }
    
    device_open_ = true;
    return Napi::Boolean::New(env, true);
}

Napi::Value FingerprintBridge::CloseDevice(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (!device_open_) {
        return Napi::Boolean::New(env, true);
    }
    
    DPFPDD_RESULT result = dpfpdd_close(device_handle_);
    device_open_ = false;
    
    if (result != DPFPDD_SUCCESS) {
        std::string error_msg = "Failed to close device: " + std::to_string(result);
        Napi::Error::New(env, error_msg).ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }
    
    return Napi::Boolean::New(env, true);
}

Napi::Value FingerprintBridge::CaptureFingerprint(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (!device_open_) {
        Napi::Error::New(env, "No device is open").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    // Set capture parameters
    DPFPDD_CAPTURE_PARAM captureParams = {0};
    captureParams.size = sizeof(DPFPDD_CAPTURE_PARAM);
    captureParams.image_fmt = DPFPDD_IMG_FMT_ISOIEC19794;
    captureParams.image_proc = DPFPDD_IMG_PROC_DEFAULT;
    captureParams.image_res = 500; // Standard resolution
    
    // Set timeout parameter (in milliseconds)
    int timeout = 10000; // Default 10 seconds
    if (info.Length() >= 1 && info[0].IsNumber()) {
        timeout = info[0].As<Napi::Number>().Int32Value();
    }
    
    // Prepare capture result
    DPFPDD_CAPTURE_RESULT captureResult = {0};
    captureResult.size = sizeof(DPFPDD_CAPTURE_RESULT);
    
    // Allocate memory for image data
    const int MAX_IMAGE_SIZE = 1000000;
    std::vector<unsigned char> imageData(MAX_IMAGE_SIZE);
    int imageSize = MAX_IMAGE_SIZE;
    
    // Capture the fingerprint
    DPFPDD_RESULT result = dpfpdd_capture(
        device_handle_,
        &captureParams,
        timeout,
        &captureResult,
        &imageSize,
        imageData.data()
    );
    
    if (result != DPFPDD_SUCCESS) {
        std::string error_msg = "Failed to capture fingerprint: " + std::to_string(result);
        Napi::Error::New(env, error_msg).ThrowAsJavaScriptException();
        return env.Null();
    }
    
    // Resize the vector to the actual size
    imageData.resize(imageSize);
    
    // Convert image data to base64
    std::string base64Image = base64Encode(imageData);
    
    // Create result object
    Napi::Object resultObj = Napi::Object::New(env);
    resultObj.Set("success", Napi::Boolean::New(env, true));
    resultObj.Set("image", Napi::String::New(env, base64Image));
    resultObj.Set("quality", Napi::Number::New(env, captureResult.quality));
    
    return resultObj;
}

Napi::Value FingerprintBridge::ExtractFeatures(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    // Check parameters
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Base64 image data expected").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string base64Image = info[0].As<Napi::String>().Utf8Value();
    
    // Decode base64 data
    std::vector<unsigned char> imageData = base64Decode(base64Image);
    
    if (imageData.empty()) {
        Napi::Error::New(env, "Failed to decode base64 image data").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    // Extract features
    DPFJ_FMD_FORMAT format = DPFJ_FMD_ISO19794_2_2005;
    
    // First, get the size of the feature data
    unsigned int featureSize = 0;
    DPFJ_RESULT result = dpfj_create_fmd_from_fid(
        DPFJ_FID_ISO19794_4_2005,
        imageData.data(),
        imageData.size(),
        format,
        NULL,
        &featureSize
    );
    
    if (result != DPFJ_SUCCESS && result != DPFJ_E_MORE_DATA) {
        std::string error_msg = "Failed to get feature size: " + std::to_string(result);
        Napi::Error::New(env, error_msg).ThrowAsJavaScriptException();
        return env.Null();
    }
    
    // Allocate memory for feature data
    std::vector<unsigned char> featureData(featureSize);
    
    // Extract features
    result = dpfj_create_fmd_from_fid(
        DPFJ_FID_ISO19794_4_2005,
        imageData.data(),
        imageData.size(),
        format,
        featureData.data(),
        &featureSize
    );
    
    if (result != DPFJ_SUCCESS) {
        std::string error_msg = "Failed to extract features: " + std::to_string(result);
        Napi::Error::New(env, error_msg).ThrowAsJavaScriptException();
        return env.Null();
    }
    
    // Convert feature data to base64
    std::string base64Features = base64Encode(featureData);
    
    // Create result object
    Napi::Object resultObj = Napi::Object::New(env);
    resultObj.Set("success", Napi::Boolean::New(env, true));
    resultObj.Set("features", Napi::String::New(env, base64Features));
    
    return resultObj;
}

Napi::Value FingerprintBridge::CompareFeatures(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    // Check parameters
    if (info.Length() < 2 || !info[0].IsString() || !info[1].IsString()) {
        Napi::TypeError::New(env, "Two base64-encoded feature sets expected").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string base64Features1 = info[0].As<Napi::String>().Utf8Value();
    std::string base64Features2 = info[1].As<Napi::String>().Utf8Value();
    
    // Decode base64 data
    std::vector<unsigned char> features1 = base64Decode(base64Features1);
    std::vector<unsigned char> features2 = base64Decode(base64Features2);
    
    if (features1.empty() || features2.empty()) {
        Napi::Error::New(env, "Failed to decode base64 feature data").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    // Compare features
    unsigned int score = 0;
    bool matched = false;
    
    DPFJ_RESULT result = dpfj_compare(
        DPFJ_FMD_ISO19794_2_2005, 
        features1.data(), 
        features1.size(),
        0, // View number (usually 0)
        DPFJ_FMD_ISO19794_2_2005,
        features2.data(),
        features2.size(),
        0, // View number (usually 0)
        &score
    );
    
    if (result != DPFJ_SUCCESS && result != DPFJ_E_NOT_MATCH) {
        std::string error_msg = "Failed to compare features: " + std::to_string(result);
        Napi::Error::New(env, error_msg).ThrowAsJavaScriptException();
        return env.Null();
    }
    
    // Usually a score above 40-60 is considered a match, depending on security requirements
    matched = (result == DPFJ_SUCCESS);
    
    // Create result object
    Napi::Object resultObj = Napi::Object::New(env);
    resultObj.Set("success", Napi::Boolean::New(env, true));
    resultObj.Set("matched", Napi::Boolean::New(env, matched));
    resultObj.Set("score", Napi::Number::New(env, score));
    
    return resultObj;
}

// Base64 encode/decode utility functions
std::string FingerprintBridge::base64Encode(const std::vector<unsigned char>& data) {
    // Base64 encoding implementation
    static const char* base64_chars = 
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    
    std::string out;
    out.reserve(((data.size() + 2) / 3) * 4);
    
    unsigned int val = 0;
    int valb = -6;
    
    for (unsigned char c : data) {
        val = (val << 8) + c;
        valb += 8;
        while (valb >= 0) {
            out.push_back(base64_chars[(val >> valb) & 0x3F]);
            valb -= 6;
        }
    }
    
    if (valb > -6) out.push_back(base64_chars[((val << 8) >> (valb + 8)) & 0x3F]);
    
    while (out.size() % 4) out.push_back('=');
    
    return out;
}

std::vector<unsigned char> FingerprintBridge::base64Decode(const std::string& encoded) {
    // Base64 decoding implementation
    static const std::string base64_chars = 
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    
    // Remove any data URL prefix if present
    std::string base64;
    if (encoded.find("data:") == 0) {
        size_t commaPos = encoded.find(',');
        if (commaPos != std::string::npos) {
            base64 = encoded.substr(commaPos + 1);
        } else {
            base64 = encoded;
        }
    } else {
        base64 = encoded;
    }
    
    std::vector<unsigned char> out;
    out.reserve(base64.length() * 3 / 4);
    
    unsigned int val = 0;
    int valb = -8;
    
    for (char c : base64) {
        if (c == '=') break;
        
        size_t pos = base64_chars.find(c);
        if (pos == std::string::npos) continue; // Skip non-base64 chars
        
        val = (val << 6) + static_cast<unsigned int>(pos);
        valb += 6;
        
        if (valb >= 0) {
            out.push_back(static_cast<unsigned char>((val >> valb) & 0xFF));
            valb -= 8;
        }
    }
    
    return out;
}

// Initialize the module
Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    return FingerprintBridge::Init(env, exports);
}

NODE_API_MODULE(fingerprint_bridge, InitAll)