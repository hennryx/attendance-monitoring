{
  "targets": [
    {
      "target_name": "fingerprint_bridge",
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "sources": [ "fingerprint_bridge.cpp" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "./sdk/include"
      ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "conditions": [
        ["OS=='win'", {
          "libraries": [
            "../sdk/lib/dpfj.lib",
            "../sdk/lib/dpfpdd.lib"
          ],
          "copies": [
            {
              "destination": "<(module_root_dir)/build/Release",
              "files": [
                "<(module_root_dir)/sdk/bin/dpfj.dll",
                "<(module_root_dir)/sdk/bin/dpfpdd.dll"
              ]
            }
          ]
        }]
      ]
    }
  ]
}