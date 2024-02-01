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

  if (typeof data?.choices?.[0]?.message?.content !== 'string') {
    return {
      statusCode: 400,
      message: 'Invalid raw podcast transcript.',
    }
  }

  const rawPodcastTranscript = data?.choices?.[0]?.message?.content

  const makePrompt = (date) =>`請使用以下原始逐字稿內容進行後製、潤飾，產生 podcast 新聞播報內容逐字稿，並符合以下要求：
- 主持人名字為 Chelsea，節目名稱為「再聽五分鐘」
- 逐字稿內容請使用台灣用詞的中文，包含以下幾點細項
  - 請不要使用「播客」一詞，請改用「podcast」
  - 請不要使用「合同」一詞，請改用「合約」
- 節目開頭，必須包含主持人的開場白
- 節目開頭，主持人必須提及今天的日期（請使用 ${date}）
- 節目內容，主持人的節奏轉折必須流暢自然
- 節目開頭，適當的加上主持人對聽眾的問候，最多一句話
- 節目接近結尾處，主持人會適當的分享自己與新聞內容的生活經驗，或是有趣的冷知識，以添增互動的感覺
- 節目結尾，主持人必須請聽眾進行支持節目的活動，例如：點讚、收藏、轉發
- 輸出的內容只能包含主持人的播報台詞，切記請勿包含任何無關逐字稿內容的提示文字（提示文字包含但不限於 ChatGPT 指示、ChatGPT 回應、節目開始提示詞、節目結束提示詞、音效提示詞）

原始逐字稿：
${rawPodcastTranscript}`

  try {
    const data = await chatCompletion(makePrompt(task.targetNews.date))

    const bucket = 'auto-news-podcast-post-processed-podcast-transcript'
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
