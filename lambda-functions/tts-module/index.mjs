import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import * as sdk from 'microsoft-cognitiveservices-speech-sdk'

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

async function writeDataToS3Bucket({ bucket, key, body, contentType }) {
  const commandInput = {
    Bucket: bucket,
    Key: key,
    Body: contentType
      ? body
      : typeof body === 'string'
      ? body
      : JSON.stringify(body),
    ...(contentType ? { ContentType: contentType } : {}),
  }

  const command = new PutObjectCommand(commandInput)

  return await s3.send(command)
}

function formatSsmlFromContent(content) {
  return `<speak
  xmlns="http://www.w3.org/2001/10/synthesis"
  xmlns:mstts="http://www.w3.org/2001/mstts"
  xmlns:emo="http://www.w3.org/2009/10/emotionml"
  version="1.0"
  xml:lang="zh-CN"
>
  <voice name="zh-CN-XiaoxiaoNeural">
    <mstts:express-as style="chat">
      ${content}
    </mstts:express-as>
  </voice>
</speak>`
}

async function synthesize(content) {
  return new Promise((resolve, reject) => {
    const subscriptionKey = process.env.TTS_API_KEY
    const serviceRegion = 'eastus'

    const speechConfig = sdk.SpeechConfig.fromSubscription(
      subscriptionKey,
      serviceRegion
    )

    speechConfig.speechSynthesisVoiceName = 'zh-CN-XiaoxiaoNeural'

    const synthesizer = new sdk.SpeechSynthesizer(speechConfig)

    const ssml = formatSsmlFromContent(content)

    synthesizer.speakSsmlAsync(
      ssml,
      function (result) {
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          console.log('Synthesis finished.')
          resolve(result)
        } else {
          console.error('Speech synthesis canceled.')
          reject(error)
        }

        synthesizer.close()
      },
      function (error) {
        reject(error)
        synthesizer.close()
      }
    )
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
      message: 'Invalid post-processed podcast transcript.',
    }
  }

  const transcript = data?.choices?.[0]?.message?.content

  try {
    const ttsData = await synthesize(transcript)

    const bucket = 'auto-news-podcast-post-processed-podcast-transcript'

    const audioKey = `${inputKey.replace(/.json$/, '.wav')}`
    const audioBody = ttsData.audioData

    await writeDataToS3Bucket({
      bucket,
      key: audioKey,
      body: audioBody,
      contentType: 'audio/wav',
    })

    const taskInfoKey = inputKey
    const taskInfoBody = { task }

    await writeDataToS3Bucket({
      bucket,
      key: taskInfoKey,
      body: taskInfoBody,
    })

    const response = {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Data successfully written to S3.',
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
