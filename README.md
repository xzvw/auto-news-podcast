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

備註:

- 目前使用的 (newsMarket, newsCategory) 組合
  - (en-us, world)
- musicTemplate: 'city-pop' | 'good-night'

### (S3 Bucket) auto-news-podcast-tasks

## 參考

- https://learn.microsoft.com/en-us/bing/search-apis/bing-news-search/reference/query-parameters
