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

async function fetchBingNews({ mkt, category }) {
  const url = `https://api.bing.microsoft.com/v7.0/news?mkt=${mkt}&category=${category}&sortBy=Relevance`
  const headers = { 'Ocp-Apim-Subscription-Key': process.env.BING_NEWS_API_KEY }

  return new Promise((resolve, reject) => {
    https
      .get(url, { headers }, (response) => {
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
    bucket: taskS3Bucket,
    key: taskS3Key,
    error,
  } = parseS3InfoFromEvent(event)

  if (error) {
    return error
  }

  const task = await readDataFromS3Bucket({
    bucket: taskS3Bucket,
    key: taskS3Key,
  })

  const {
    taskId,
    targetNews: { newsMarket, newsCategory },
  } = task

  try {
    const data = await fetchBingNews({
      mkt: newsMarket,
      category: newsCategory,
    })

    const bucket = 'auto-news-podcast-news-api-data'
    const key = `${taskId}.json`
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
