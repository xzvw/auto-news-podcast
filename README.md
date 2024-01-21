# Auto News Podcast

## AWS Settings

Region: us-east-1 (N. Virginia)

## AWS Components

### (Lambda) task-module

- Runtime: Node.js 18.x
- Architecture: x86_64
- IAM role: task-module-role-3vfz3xo6
  - Permissions policies:
    - AWSLambdaBasicExecutionRole-60960177-3597-49b2-8696-ffa915b53682
    - AmazonS3FullAccess
- Triggers
  - EventBridge (CloudWatch Events)
    - Rule name: daily-podcast-pipeline
    - Schedule expression: `cron(0 1 * * ? *)`
  - API Gateway
    - POST https://luxk8ydfee.execute-api.us-east-1.amazonaws.com/default/task-module
    - body 帶上 newsMarket, newsCategory, musicTemplate
- 輸出至 (S3 Bucket) auto-news-podcast-tasks

輸出範例:

```jsonc
// Filename: 2024-1-19-1705704341206.json
{
  "taskId": "2024-1-19-1705704341206",
  "createdTime": "2024-01-19T22:45:41.206Z",
  "targetNews": {
    "date": "2024-1-19",
    // 目前使用的 (newsMarket, newsCategory) 組合為 (en-us, world)
    "newsMarket": "en-us",
    "newsCategory": "world"
  },
  "musicTemplate": "good-night" // "city-pop" | "good-night"
}
```

### (S3 Bucket) auto-news-podcast-tasks

### (Lambda) fetch-news-api-module

- Runtime: Node.js 18.x
- Architecture: x86_64
- IAM role: fetch-news-api-module-role-m944zx9m
  - Permissions policies:
    - AWSLambdaBasicExecutionRole-5a84f63e-af3c-4e76-8f3b-0240ea219730
    - AmazonS3FullAccess
- Triggers
  - API Gateway
    - POST https://e42b1kj7ja.execute-api.us-east-1.amazonaws.com/default/fetch-news-api-module
    - body 帶上 bucket, key
  - S3
    - Bucket: auto-news-podcast-tasks
    - Event types: PUT
    - Suffix: .json
- 輸出至 (S3 Bucket) auto-news-podcast-news-api-data
- 有設定環境變數 BING_NEWS_API_KEY

輸出範例:

```jsonc
// Filename: 2024-1-19-1705704341206.json
{
  "task": {
    "taskId": "2024-1-19-1705704341206",
    "createdTime": "2024-01-19T22:45:41.206Z",
    "targetNews": {
      "date": "2024-1-19",
      "newsMarket": "en-us",
      "newsCategory": "world"
    },
    "musicTemplate": "good-night"
  },
  "data": {
    // parsed data object here
  }
}
```

其中 parsed data 範例:

```jsonc
{
  "_type": "News",
  "webSearchUrl": "https://www.bing.com/news/search?q=world+news&form=TNSA02",
  "value": [
    {
      "name": "Netanyahu rules out Palestinian state as being 'incompatible' with Israeli security",
      "url": "https://www.msn.com/en-us/news/world/netanyahu-rules-out-palestinian-state-as-being-incompatible-with-israeli-security/ar-BB1gWkYZ",
      "image": {
        "thumbnail": {
          "contentUrl": "https://www.bing.com/th?id=OVFT.plrQhrxWOx6zmflDKGf-WC&pid=News",
          "width": 800,
          "height": 533
        },
        "isLicensed": true
      },
      "description": "Israel's Prime Minister, Benjamin Netanyahu, said he has rejected U.S. calls for a Palestinian state after the war in Gaza ends.",
      "provider": [
        {
          "_type": "Organization",
          "name": " UPI News",
          "image": {
            "thumbnail": {
              "contentUrl": "https://www.bing.com/th?id=ODF.cpo3ek4OYDsinkv1bzpa2Q&pid=news"
            }
          }
        }
      ],
      "datePublished": "2024-01-19T21:34:00.0000000Z"
    }
    // ...more news items
  ]
}
```

### (S3 Bucket) auto-news-podcast-news-api-data

### (Lambda) fetch-news-content-module

因為 chromium 與 puppeteer 一直設定不好, 因此使用 AWS SAM 來建立

建立了以下資源:

- S3 Bucket: aws-sam-cli-managed-default-samclisourcebucket-gmqknwtjhlnr
- 基於 template.yml 建立的資源
  - Lambda Layer: ChromiumLayer9553ccf2b5 (ChromiumLayer)
  - IAM Role: FetchNewsContentModuleRole (sam-fetch-news-content-mo-FetchNewsContentModuleRol-BAuv5dS7fKG4)
  - Lambda Function: FetchNewsContentModule (sam-fetch-news-content-modu-FetchNewsContentModule-U6k47AGgNf09)
- Triggers
  - API Gateway
    - POST https://9ew9rvvih0.execute-api.us-east-1.amazonaws.com/default/sam-fetch-news-content-modu-FetchNewsContentModule-U6k47AGgNf09
    - body 帶上 bucket, key
- 輸出至 (S3 Bucket) auto-news-podcast-news-content

### (S3 Bucket) auto-news-podcast-news-content

### (Lambda) post-process-news-content-module

- Runtime: Node.js 18.x
- Architecture: x86_64
- IAM role: post-process-news-content-module-role-7619m6np
  - Permissions policies:
    - AWSLambdaBasicExecutionRole-cd4f9879-54be-4a7b-8419-88ff28d9ac3d
    - AmazonS3FullAccess
- Triggers
  - API Gateway
    - POST https://lbjsh2urp0.execute-api.us-east-1.amazonaws.com/default/post-process-news-content-module
    - body 帶上 bucket, key (...end.json)
  - S3
    - Bucket: auto-news-podcast-news-content
    - Event types: PUT
    - Suffix: end.json
- 輸出至 (S3 Bucket) auto-news-podcast-post-processed-news-content

### (S3 Bucket) auto-news-podcast-post-processed-news-content

### (Lambda) generate-podcast-transcript-module

- Runtime: Node.js 18.x
- Architecture: x86_64
- IAM role: generate-podcast-transcript-module-role-42cvdq20
  - Permissions policies:
    - AWSLambdaBasicExecutionRole-6c217f42-503a-414e-8138-8f8feb0bd7fc
    - AmazonS3FullAccess
- Triggers
  - API Gateway: 因為 request 超過 30 秒會被 API Gateway drop, 故不使用
  - S3
    - Bucket: auto-news-podcast-post-processed-news-content
    - Event types: PUT
    - Suffix: .json
- 輸出至 (S3 Bucket) auto-news-podcast-raw-podcast-transcript
- 有設定環境變數 OPEN_AI_API_KEY
- Timeout: 3min

### (S3 Bucket) auto-news-podcast-raw-podcast-transcript

### (Lambda) post-process-podcast-transcript-module

- Runtime: Node.js 18.x
- Architecture: x86_64
- IAM role: post-process-podcast-transcript-module-role-6mg7uuc2
  - Permissions policies:
    - AWSLambdaBasicExecutionRole-6a65b9ba-b6af-46d9-985c-d6f2cd30501d
    - AmazonS3FullAccess
- Triggers
  - API Gateway: 因為 request 超過 30 秒會被 API Gateway drop, 故不使用
  - S3
    - Bucket: auto-news-podcast-raw-podcast-transcript
    - Event types: PUT
    - Suffix: .json
- 輸出至 (S3 Bucket) auto-news-podcast-post-processed-podcast-transcript
- 有設定環境變數 OPEN_AI_API_KEY
- Timeout: 3min

### (S3 Bucket) auto-news-podcast-post-processed-podcast-transcript

### (Lambda) tts-module

因為包含 dependency, 因此使用 .zip 的方式上傳

打包 package.zip: `find . -name .DS_Store -type f -delete && zip -r package.zip .`

- Runtime: Node.js 18.x
- Architecture: x86_64
- IAM role: tts-module-role-yykteejk
  - Permissions policies:
    - AWSLambdaBasicExecutionRole-6dd4498a-c206-4ee6-9f2d-8a80dbd9f370
    - AmazonS3FullAccess
- Triggers
  - API Gateway: 因為 request 超過 30 秒會被 API Gateway drop, 故不使用
  - S3
    - Bucket: auto-news-podcast-post-processed-podcast-transcript
    - Event types: PUT
    - Suffix: .json
- 輸出至 (S3 Bucket) auto-news-podcast-transcript-vocals
- 有設定環境變數 TTS_API_KEY
- Timeout: 3min

### (S3 Bucket) auto-news-podcast-transcript-vocals

### (S3 Bucket) auto-news-podcast-background-music

### (Lambda) audio-processor-module

因為包含 dependency, 因此使用 .zip 的方式上傳

打包 package.zip:

```shell
# 在 auto-news-podcast/lambda-functions/audio-processor-module 執行
find . -name .DS_Store -type f -delete && \
cd venv/lib/python3.11/site-packages && \
zip -r ${OLDPWD}/function.zip . && \
cd $OLDPWD &&  \
zip -g function.zip lambda_function.py
```

開發:

```shell
python3 -m venv venv
source venv/bin/activate
pip3 install pydub
```

使用了 lambda layers (s3://auto-news-podcast-lambda-layers/pydub.zip)

- Runtime: Python 3.12
- Architecture: x86_64
- IAM role: audio-processor-module-role-8vkmlu9q
  - Permissions policies:
    - AWSLambdaBasicExecutionRole-c9ee3707-9191-4dd8-8605-1fcae0ffb3d3
    - AmazonS3FullAccess
- Triggers
  - API Gateway
    - POST https://dn5gzgno44.execute-api.us-east-1.amazonaws.com/default/audio-processor-module
    - body 帶上 bucket, key (範例: 2024-1-19-1705704341206.json)
  - S3
    - Bucket: auto-news-podcast-transcript-vocals
    - Event types: PUT
    - Suffix: .json
- 輸出至 (S3 Bucket) auto-news-podcast-final-audios
- Memory: 1024MB
- Timeout: 1min

### (S3 Bucket) auto-news-podcast-final-audios

### (Lambda) generate-episode-info-module

❌ 尚未實作

- Runtime: Node.js 18.x
- Architecture: x86_64
- IAM role: generate-episode-info-module-role-gmbjffb4
  - Permissions policies:
    - AWSLambdaBasicExecutionRole-70435f98-590b-4612-abc5-01b642c9b886
    - AmazonS3FullAccess
- Triggers
  - API Gateway: 因為 request 超過 30 秒會被 API Gateway drop, 故不使用
  - S3
    - Bucket: auto-news-podcast-final-audios
    - Event types: PUT
    - Suffix: .mp3
    - 備註: 因為同樣 bucket 的 overlapping object 不能作為兩個 lambda functions 的 trigger, 所以這裡不使用 auto-news-podcast-post-processed-podcast-transcript 作為觸發 bucket
- 輸出至 (S3 Bucket) auto-news-podcast-episode-info
- 有設定環境變數 OPEN_AI_API_KEY
- Timeout: 3min

### (S3 Bucket) auto-news-podcast-episode-info

### (Lambda) generate-rss-by-episode-info-module

❌ 尚未建立

### (Lambda) public-rss-module

❌ 尚未建立

## Bucket Pipeline

- auto-news-podcast-tasks
- auto-news-podcast-news-api-data
- auto-news-podcast-news-content
- auto-news-podcast-post-processed-news-content
- auto-news-podcast-raw-podcast-transcript
- auto-news-podcast-post-processed-podcast-transcript
- auto-news-podcast-transcript-vocals
- auto-news-podcast-final-audios

## 參考

- https://learn.microsoft.com/en-us/bing/search-apis/bing-news-search/reference/query-parameters

## 資源

- 背景音樂: FASSounds from Pixabay https://pixabay.com/users/fassounds-3433550/
