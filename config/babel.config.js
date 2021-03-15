module.exports = {
    "cacheDirectory": true,
    "cacheIdentifier": "3",
    "presets": [
        [
            "cx-env",
            {
                // targets: {
                //     chrome: 66
                // },
                  targets: {
                      esmodules: true,
                  },
                loose: true,
                modules: false,
                cx: {
                    imports: {
                        useSrc: true
                    }
                }
            }
        ]
    ],
    "plugins": []
};

