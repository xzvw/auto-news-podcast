import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const s3 = new S3Client({ region: 'us-east-1' })

async function writeDataToS3Bucket({ bucket, key, body }) {
  const commandInput = {
    Bucket: bucket,
    Key: key,
    Body: typeof body === 'string' ? body : JSON.stringify(body),
  }

  const command = new PutObjectCommand(commandInput)

  return await s3.send(command)
}

function formatCurrentDate(dateObject) {
  const segments = [
    dateObject.getUTCFullYear(),
    dateObject.getUTCMonth() + 1,
    dateObject.getUTCDate(),
  ]

  const currentDate = segments.join('-')

  return currentDate
}

function formatTaskId(dateObject) {
  const taskId = `${formatCurrentDate(dateObject)}-${dateObject.valueOf()}`

  return taskId
}

export const handler = async (event) => {
  // Handle POST
  const requestBody = event.body

  if (!requestBody) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: `Empty request body.` }),
    }
  }

  const parsedRequestBody = JSON.parse(event.body)
  const requiredFields = ['newsMarket', 'newsCategory', 'musicTemplate']

  for (const field of requiredFields) {
    if (!(field in parsedRequestBody)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Missing ${field} field.` }),
      }
    }
  }

  const { newsMarket, newsCategory, musicTemplate } = parsedRequestBody

  const currentDateObject = new Date()
  const taskId = formatTaskId(currentDateObject)

  const task = {
    taskId,
    createdTime: currentDateObject,
    targetNews: {
      date: formatCurrentDate(currentDateObject),
      newsMarket,
      newsCategory,
    },
    musicTemplate,
  }

  const bucket = 'auto-news-podcast-tasks'
  const key = `${taskId}.json`
  const body = task

  await writeDataToS3Bucket({ bucket, key, body })

  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Data successfully written to S3.',
      data: { bucket, key, body },
    }),
  }

  return response
}
