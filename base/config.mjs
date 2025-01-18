import Nconf from 'nconf-lite'

const nconf = new Nconf()

// Helper method for global usage.
nconf.inTest = () => nconf.get('NODE_ENV') === 'test'

// Config follow the following priority check order:
// 1. Enviroment variables
// 2. package.json
// 3. config/config.json
// 4. config/config.default.json



// Load enviroment variables as first priority
nconf.env({
  separator: '__',
  whitelist: [
    'NODE_ENV',
    'mssql__connectionString',
    'media__secret',
    'media__iss',
    'media__path',
    'media__filePath',
    'media__removePath',
    'frontend__url',
    'jwtsecret',
  ],
  parseValues: true,
})


// Load empty overrides that can be overwritten later
nconf.overrides({})

nconf.defaults({
  "NODE_ENV": "development",
  "frontend": {
    "url": "http://beta01.nfp.moe"
  },
  "jwtsecret": "w2bkdWAButfdfEkCs8dpE3L2n6QzCfhna0T4",
  "mssql": {
    "conn_timeout": 5,
    "floor": 1,
    "ceiling": 2,
    "heartbeatSecs": 20,
    "inactivityTimeoutSecs": 60,
    "connectionString": "Driver={ODBC Driver 17 for SQL Server}; Server=localhost;UID=dev; PWD=dev; Database=nfp_moe",
  },
  "media": {
    "secret": "upload-secret-key-here",
    "iss": "dev",
    "path": "https://media.nfp.is/media/resize",
    "filePath": "https://media.nfp.is/media",
    "directFilePath": "https://media.nfp.is/media/noprefix",
    "removePath": "https://media.nfp.is/media/",
    "preview": {
      "out": "base64",
      "format": "avif",
      "blur": 10,
      "resize": {
        "width": 200,
        "height": 200,
        "fit": "inside",
        "withoutEnlargement": true,
        "kernel": "lanczos3"
      },
      "avif": {
        "quality": 30,
        "effort": 9
      }
    },
    "small": {
      "jpeg": {
        "format": "jpeg",
        "resize": {
          "width": 720,
          "height": 720,
          "fit": "inside",
          "withoutEnlargement": true,
          "kernel": "lanczos3"
        },
        "jpeg": {
          "quality": 93
        }
      },
      "avif": {
        "format": "avif",
        "resize": {
          "width": 720,
          "height": 720,
          "fit": "inside",
          "withoutEnlargement": true,
          "kernel": "lanczos3"
        },
        "avif": {
          "quality": 60,
          "effort": 3
        }
      }
    },
    "medium": {
      "jpeg": {
        "format": "jpeg",
        "resize": {
          "width": 1300,
          "height": 1300,
          "fit": "inside",
          "withoutEnlargement": true,
          "kernel": "lanczos3"
        },
        "jpeg": {
          "quality": 93
        }
      },
      "avif": {
        "format": "avif",
        "resize": {
          "width": 1300,
          "height": 1300,
          "fit": "inside",
          "withoutEnlargement": true,
          "kernel": "lanczos3"
        },
        "avif": {
          "quality": 75,
          "effort": 3
        }
      }
    },
    "large": {
      "jpeg": {
        "format": "jpeg",
        "resize": {
          "width": 3000,
          "height": 3000,
          "fit": "inside",
          "withoutEnlargement": true,
          "kernel": "lanczos3"
        },
        "jpeg": {
          "quality": 95
        }
      },
      "avif": {
        "format": "avif",
        "resize": {
          "width": 3000,
          "height": 3000,
          "fit": "inside",
          "withoutEnlargement": true,
          "kernel": "lanczos3"
        },
        "avif": {
          "quality": 85,
          "effort": 3
        }
      }
    },
  },
  "fileSize": 524288000
})


export default nconf
