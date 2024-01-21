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

## 參考

- https://learn.microsoft.com/en-us/bing/search-apis/bing-news-search/reference/query-parameters
