import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

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
    key: inputEndKey,
    error,
  } = parseS3InfoFromEvent(event)

  if (error) {
    return error
  }

  const merged = {
    task: null,
    data: [],
  }

  // 使用 decodeURIComponent 的原因是, # 會被 encode 成 %23
  const taskId = decodeURIComponent(inputEndKey).split('#')[0]
  const endIndex = Number(decodeURIComponent(inputEndKey).replace(/-end.json$/, '').split('#')[1])

  // Merging data
  for (let i = 0; i <= endIndex; i++) {
    const readKey = `${taskId}#${i !== endIndex ? i : `${i}-end`}.json`

    const { task: inputTask, data: inputData } = await readDataFromS3Bucket({
      bucket: inputBucket,
      key: readKey,
    })

    if (!merged.task) {
      merged.task = inputTask
    }

    merged.data.push(inputData)
  }

  const outputBucket = 'auto-news-podcast-post-processed-news-content'
  const outputKey = `${taskId}.json`

  await writeDataToS3Bucket({
    bucket: outputBucket,
    key: outputKey,
    body: merged,
  })

  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Data successfully written to S3.',
      data: {
        bucket: outputBucket,
        key: outputBucket,
        body: merged,
      },
    }),
  }

  return response
}
