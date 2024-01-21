import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

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

function sleep(milliseconds) {
  return new Promise((resolve) =>
    setTimeout(() => {
      resolve()
    }, milliseconds)
  )
}

export const handler = async (event) => {
  const {
    bucket: sourceS3Bucket,
    key: sourceS3Key,
    error,
  } = parseS3InfoFromEvent(event)

  if (error) {
    return error
  }

  let { task, data } = await readDataFromS3Bucket({
    bucket: sourceS3Bucket,
    key: sourceS3Key,
  })

  if (!task || !data || !Array.isArray(data?.value)) {
    throw new Error('Malformed input.')
  }

  console.log('*** puppeteer.launch')
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  })

  console.log('*** browser.pages')
  const [page] = await browser.pages()

  console.log('*** page.setUserAgent')
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  )

  const newsList = data.value
  const topNewsList = newsList.slice(0, 10)

  for (let i = 0; i < topNewsList.length; i++) {
    const rawNews = topNewsList[i]
    const url = rawNews.url

    console.log(`*** index=${i}, page.goto`, url)
    await page.goto(url, { waitUntil: 'domcontentloaded' })

    console.log(`*** index=${i}, sleep`)
    await sleep(3000)

    console.log(`*** index=${i}, await page.evaluate`, url)
    const collectedContent = await page.evaluate(() => {
      const excludedTagNameList = ['SCRIPT', 'STYLE']

      function collectContent(node) {
        if (excludedTagNameList.includes(node.tagName)) {
          return []
        }

        if (node.nodeType === Node.TEXT_NODE) {
          return [node.nodeValue]
        }

        if (node.shadowRoot) {
          return collectContent(node.shadowRoot)
        }

        return [...node.childNodes].flatMap(collectContent)
      }

      return collectContent(document.body).join('\n')
    })

    const output = { task, data: { rawNews, collectedContent } }
    console.log('*** output', output)

    const destinationS3Bucket = 'auto-news-podcast-news-content'
    const destinationS3Key = `${task.taskId}#${i}${
      i === topNewsList.length - 1 ? '-end' : ''
    }.json`

    writeDataToS3Bucket({
      bucket: destinationS3Bucket,
      key: destinationS3Key,
      body: output,
    })
    console.log('*** writeDataToS3Bucket', {
      destinationS3Bucket,
      destinationS3Key,
      body: output,
    })
  }

  await browser.close()

  return { success: true }
}
