import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import https from 'https'

const s3 = new S3Client({ region: 'us-east-1' })

async function readDataFromS3Bucket({ bucket, key }) {
  const commandInput = {
    Bucket: bucket,
    Key: key,
  }

  const command = new GetObjectCommand(commandInput)

  const response = await s3.send(command)
  const bodyString = await response.Body.transformToString()
  return JSON.parse(bodyString)
}

async function writeDataToS3Bucket({ bucket, key, body }) {
  const commandInput = {
    Bucket: bucket,
    Key: key,
    Body: typeof body === 'string' ? body : JSON.stringify(body),
  }

  const command = new PutObjectCommand(commandInput)

  return await s3.send(command)
}

async function chatCompletion(prompt) {
  const data = JSON.stringify({
    model: 'gpt-4-1106-preview',
    messages: [{ role: 'user', content: prompt }],
  })

  const options = {
    hostname: 'api.openai.com',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPEN_AI_API_KEY}`,
    },
  }

  return new Promise((resolve, reject) => {
    const req = https
      .request(options, (response) => {
        let data = ''

        response.on('data', (chunk) => {
          data += chunk
        })

        response.on('end', () => {
          const parsedData = JSON.parse(data)

          resolve(parsedData)
        })
      })
      .on('error', (error) => {
        reject(error)
      })

    req.write(data)
    req.end()
  })
}

function parseS3InfoFromEvent(event) {
  // Handle POST
  const requestBody = event.body

  if (requestBody) {
    const parsedRequestBody = JSON.parse(event.body)
    const { bucket, key } = parsedRequestBody

    return { bucket, key }
  }

  // S3 PUT
  const bucket = event.Records[0].s3.bucket.name
  const key = event.Records[0].s3.object.key

  return { bucket, key }
}

export const handler = async (event) => {
  const {
    bucket: inputBucket,
    key: inputKey,
    error,
  } = parseS3InfoFromEvent(event)

  if (error) {
    return error
  }

  const { task, data } = await readDataFromS3Bucket({
    bucket: inputBucket,
    key: inputKey,
  })

  // Make a compressed data
  const compressedData = data.map(({ rawNews, collectedContent }) => ({
    name: rawNews.name,
    description: rawNews.description,
    providerName: rawNews.provider.name,
    datePublished: rawNews.datePublished,
    content: collectedContent.replace(/\n/g, '').replace(/\s+/g, ' '),
  }))

  const prompt = `請使用以下新聞資料（包含五則新聞），產生新聞播報節目的逐字稿，以下是詳細需求說明：

- 輸出的內容應為中文
- 輸出的內容，其每則新聞播報長度應為一分鐘左右
- 輸出的內容僅包含主持人的播報台詞，請勿包含任何提示文字（例如：ChatGPT 指示、節目開始、節目結束、音效），也不需要加上開場台詞、結尾台詞

輸出內容格式如下：
第一則新聞，（第一則新聞內容⋯⋯）
第二則新聞，（第二則新聞內容⋯⋯）
第三則新聞，（第三則新聞內容⋯⋯）
第四則新聞，（第四則新聞內容⋯⋯）
第五則新聞，（第五則新聞內容⋯⋯）

${JSON.stringify(compressedData)}`

  try {
    const data = await chatCompletion(prompt)

    const bucket = 'auto-news-podcast-raw-podcast-transcript'
    const key = inputKey
    const body = { task, data }

    await writeDataToS3Bucket({
      bucket,
      key,
      body,
    })

    const response = {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Data successfully written to S3.',
        data: { bucket, key, body },
      }),
    }

    return response
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    }
  }
}
