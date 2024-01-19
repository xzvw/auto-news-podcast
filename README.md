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

備註:

- 目前使用的 (newsMarket, newsCategory) 組合
  - (en-us, world)
- musicTemplate: 'city-pop' | 'good-night'

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
  - S3
    - Bucket: s3/auto-news-podcast-tasks
    - Event types: PUT
    - Suffix: .json
- 有設定環境變數 BING_NEWS_API_KEY

### (S3 Bucket) auto-news-podcast-news-api-data

## 參考

- https://learn.microsoft.com/en-us/bing/search-apis/bing-news-search/reference/query-parameters
